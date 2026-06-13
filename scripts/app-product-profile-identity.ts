const APP_PRODUCT_PROFILE_OWNER = 'one-person-lab-app';
const APP_PRODUCT_PROFILE_PURPOSE = 'app_owned_product_profile';
const APP_PRODUCT_PROFILE_REPO = 'gaofeng21cn/one-person-lab-app';

type ProductProfileIdentity = {
  owner?: unknown;
  purpose?: unknown;
  app_repo?: unknown;
};

export function assertAppProductProfileIdentity(
  profile: ProductProfileIdentity,
  label = 'App product profile',
): void {
  if (profile.owner !== APP_PRODUCT_PROFILE_OWNER) {
    throw new Error(`Unexpected ${label} owner: ${profile.owner}`);
  }
  if (profile.purpose !== APP_PRODUCT_PROFILE_PURPOSE) {
    throw new Error(`Unexpected ${label} purpose: ${profile.purpose}`);
  }
  if (profile.app_repo !== APP_PRODUCT_PROFILE_REPO) {
    throw new Error(`Unexpected ${label} repo: ${profile.app_repo}`);
  }
}
