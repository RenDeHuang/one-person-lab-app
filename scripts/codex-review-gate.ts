type GitHubReview = {
  user?: { login?: string | null } | null;
  commit_id?: string | null;
};

type ReviewThread = {
  isResolved: boolean;
  isOutdated: boolean;
  comments: Array<{ author?: { login?: string | null } | null }>;
};

export type CodexReviewGateInput = {
  headSha: string;
  reviews: GitHubReview[];
  reviewThreads: ReviewThread[];
};

export type CodexReviewGateResult = {
  status: 'waiting' | 'failed' | 'passed' | 'inconclusive';
  summary: string;
};

const codexBotLogin = 'chatgpt-codex-connector';

function normalizedLogin(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/\[bot\]$/, '');
}

function isCodexBot(value: string | null | undefined): boolean {
  return normalizedLogin(value) === codexBotLogin;
}

function hasCurrentCodexReview(reviews: GitHubReview[], headSha: string): boolean {
  return reviews.some(
    (review) => isCodexBot(review.user?.login) && String(review.commit_id ?? '').toLowerCase() === headSha,
  );
}

function unresolvedCurrentCodexThreads(reviewThreads: ReviewThread[]): ReviewThread[] {
  return reviewThreads.filter(
    (thread) =>
      !thread.isResolved &&
      !thread.isOutdated &&
      thread.comments.some((comment) => isCodexBot(comment.author?.login)),
  );
}

export function evaluateCodexReviewGate(input: CodexReviewGateInput): CodexReviewGateResult {
  const currentReview = hasCurrentCodexReview(input.reviews, input.headSha);
  if (!currentReview) {
    return {
      status: 'waiting',
      summary: `Waiting for Codex to create a pull-request review record for ${input.headSha.slice(0, 12)}.`,
    };
  }

  const unresolvedThreads = unresolvedCurrentCodexThreads(input.reviewThreads);
  if (unresolvedThreads.length > 0) {
    return {
      status: 'failed',
      summary: `Codex has ${unresolvedThreads.length} unresolved current review thread(s). Resolve or supersede them before merging.`,
    };
  }

  return {
    status: 'passed',
    summary: `Codex reviewed ${input.headSha.slice(0, 12)} and has no unresolved current threads.`,
  };
}

export function finalizeCodexReviewGateResult(
  result: CodexReviewGateResult,
  waitSeconds: number,
): CodexReviewGateResult {
  if (result.status !== 'waiting') return result;
  return {
    status: 'inconclusive',
    summary: `${result.summary} No immutable Codex review record arrived after ${waitSeconds} seconds; reaction-only evidence is intentionally inconclusive for this advisory.`,
  };
}

type GitHubRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = requiredEnvironment('GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`);
  return (await response.json()) as T;
}

async function paginatedGitHubRequest<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await githubRequest<T[]>(`${path}${separator}per_page=100&page=${page}`);
    results.push(...batch);
    if (batch.length < 100) return results;
  }
}

async function fetchReviewThreads(request: GitHubRequest, owner: string, repo: string, pullNumber: number): Promise<ReviewThread[]> {
  const query = `
    query($owner: String!, $repo: String!, $pullNumber: Int!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pullNumber) {
          reviewThreads(first: 100, after: $cursor) {
            nodes {
              isResolved
              isOutdated
              comments(first: 100) { nodes { author { login } } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `;
  const threads: ReviewThread[] = [];
  let cursor: string | null = null;
  do {
    const response = await request<{
      data?: {
        repository?: {
          pullRequest?: {
            reviewThreads?: {
              nodes?: Array<{
                isResolved: boolean;
                isOutdated: boolean;
                comments?: { nodes?: Array<{ author?: { login?: string | null } | null }> };
              }>;
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            };
          };
        };
      };
    }>('/graphql', {
      method: 'POST',
      body: JSON.stringify({ query, variables: { owner, repo, pullNumber, cursor } }),
      headers: { 'Content-Type': 'application/json' },
    });
    const reviewThreads = response.data?.repository?.pullRequest?.reviewThreads;
    if (!reviewThreads) throw new Error(`Pull request #${pullNumber} was not found`);
    threads.push(
      ...(reviewThreads.nodes ?? []).map((thread) => ({
        isResolved: thread.isResolved,
        isOutdated: thread.isOutdated,
        comments: thread.comments?.nodes ?? [],
      })),
    );
    cursor = reviewThreads.pageInfo?.hasNextPage ? reviewThreads.pageInfo.endCursor ?? null : null;
  } while (cursor);
  return threads;
}

function parsePositiveInteger(raw: string, label: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const [owner, repo] = requiredEnvironment('GITHUB_REPOSITORY').split('/');
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must be owner/repository');
  const pullNumber = parsePositiveInteger(requiredEnvironment('PULL_NUMBER'), 'PULL_NUMBER');
  if (pullNumber === 0) throw new Error('PULL_NUMBER must be positive');
  const waitSeconds = parsePositiveInteger(process.env.CODEX_REVIEW_WAIT_SECONDS ?? '0', 'CODEX_REVIEW_WAIT_SECONDS');
  const pollSeconds = parsePositiveInteger(process.env.CODEX_REVIEW_POLL_SECONDS ?? '30', 'CODEX_REVIEW_POLL_SECONDS');
  if (pollSeconds === 0) throw new Error('CODEX_REVIEW_POLL_SECONDS must be positive');

  const pull = await githubRequest<{ head: { sha: string } }>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  const headSha = pull.head.sha.toLowerCase();
  const deadlineMs = Date.now() + waitSeconds * 1_000;

  for (;;) {
    const [reviews, reviewThreads] = await Promise.all([
      paginatedGitHubRequest<GitHubReview>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`),
      fetchReviewThreads(githubRequest, owner, repo, pullNumber),
    ]);
    const result = evaluateCodexReviewGate({
      headSha,
      reviews,
      reviewThreads,
    });

    if (result.status === 'waiting' && Date.now() < deadlineMs) {
      console.log(`${result.summary} Polling for up to ${waitSeconds} seconds.`);
      await sleep(pollSeconds * 1_000);
      continue;
    }

    const terminal = finalizeCodexReviewGateResult(result, waitSeconds);
    console.log(terminal.summary);
    if (terminal.status === 'failed') throw new Error(terminal.summary);
    return;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
