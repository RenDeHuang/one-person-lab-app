$ErrorActionPreference = 'Stop'

$path = 'C:\Users\oplrunner\OnePersonLab\staging\node-v24.11.0-linux-x64.tar.gz'
$output = 'C:\Users\oplrunner\OnePersonLab\staging\node-bridge-evidence.txt'
$expectedSha256 = 'b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd'
$expectedSize = 58899117

$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
$actualSize = (Get-Item -LiteralPath $path).Length

@(
  "observed_at=$((Get-Date).ToString('o'))"
  "path=$path"
  "sha256=$actualSha256"
  "size=$actualSize"
) | Set-Content -Encoding utf8 $output

if ($actualSha256 -ne $expectedSha256 -or $actualSize -ne $expectedSize) {
  throw "Node bridge artifact identity mismatch"
}
