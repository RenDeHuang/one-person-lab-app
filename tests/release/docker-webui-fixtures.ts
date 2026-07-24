import fs from 'node:fs';
import path from 'node:path';

export const dockerWebuiImageRef = 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest';
export const dockerWebuiImageDigest = `sha256:${'a'.repeat(64)}`;

export function dockerWebuiRepoDigest(digest = dockerWebuiImageDigest) {
  return `ghcr.io/gaofeng21cn/one-person-lab-webui@${digest}`;
}

export function writeDockerWebuiDiagnostics(root: string) {
  const files = {
    'metadata.txt': 'gate=existing_docker\n',
    'diagnostics-manifest.json': JSON.stringify({ schema: 'opl_docker_webui_diagnostics_manifest.v1' }),
    'compose.yaml': [
      'services:',
      '  webui:',
      `    image: ${dockerWebuiImageRef}`,
      '    environment:',
      '      AIONUI_DATA_DIR: /data',
      '      OPL_PROJECTS_DIR: /projects',
      '    volumes:',
      '      - "/tmp/data:/data"',
      '      - "/tmp/projects:/projects"',
      '',
    ].join('\n'),
    'docker-version.txt': 'Docker version 27.0.0\n',
    'docker-compose-version.txt': 'Docker Compose version v2.0.0\n',
    'docker-compose-ps.txt': 'webui running\n',
    'docker-compose-logs.txt': 'ready\n',
    'docker-image.txt': JSON.stringify([{
      Id: dockerWebuiImageDigest,
      RepoDigests: [dockerWebuiRepoDigest()],
    }]),
    'http-probe.txt': 'url=http://localhost:3000/\nstatus=200\n',
    'directories.txt': 'data_dir=/tmp/data\nprojects_dir=/tmp/projects\n',
    'data-preservation.txt': 'verdict=preserved_or_reused\n[pre_data_inventory]\nexists=true\n[post_data_inventory]\nexists=true\n[pre_projects_inventory]\nexists=true\n[post_projects_inventory]\nexists=true\n',
  };
  fs.mkdirSync(root, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, file), contents);
  }
}
