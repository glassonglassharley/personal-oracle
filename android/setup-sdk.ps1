# Sets up Android SDK at ~/.bubblewrap/android_sdk from the downloaded cmdline-tools zip
$JAVA_HOME   = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$sdkRoot     = "C:\Users\jmeny\.bubblewrap\android_sdk"
$zipFile     = "C:\Users\jmeny\.bubblewrap\cmdlinetools.zip"
$extractTemp = "C:\Users\jmeny\.bubblewrap\cmdlinetools-extract"
$toolsTarget = "$sdkRoot\cmdline-tools\latest"

$env:JAVA_HOME = $JAVA_HOME
$env:PATH = "$JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME = $sdkRoot

# --- Extract cmdline-tools ---
if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }
Write-Host "Extracting cmdline-tools..."
Expand-Archive -Path $zipFile -DestinationPath $extractTemp -Force

# The zip typically contains a top-level 'cmdline-tools' folder
$innerTools = "$extractTemp\cmdline-tools"
if (-not (Test-Path $innerTools)) {
    Write-Error "Expected $innerTools after extraction"
    exit 1
}

New-Item -ItemType Directory -Path (Split-Path $toolsTarget -Parent) -Force | Out-Null
if (Test-Path $toolsTarget) { Remove-Item $toolsTarget -Recurse -Force }
Move-Item $innerTools $toolsTarget -Force
Write-Host "Placed cmdline-tools at: $toolsTarget"

$sdkManager = "$toolsTarget\bin\sdkmanager.bat"
if (-not (Test-Path $sdkManager)) {
    Write-Error "sdkmanager.bat not found at $sdkManager"
    Get-ChildItem $toolsTarget\bin -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "sdkmanager found: $sdkManager"

# --- Accept licenses ---
Write-Host "Accepting Android SDK licenses..."
$licensesProc = Start-Process -FilePath $sdkManager -ArgumentList "--licenses", "--sdk_root=$sdkRoot" `
    -Wait -PassThru -NoNewWindow -RedirectStandardInput "NUL"
# sdkmanager --licenses prompts y/n; pipe y repeatedly
$yesInput = "y`ny`ny`ny`ny`ny`ny`ny`ny`ny`n"
$yesInput | & $sdkManager --licenses --sdk_root=$sdkRoot

# --- Install required components ---
Write-Host "Installing SDK components (platforms;android-34, build-tools;34.0.0, platform-tools)..."
& $sdkManager --sdk_root=$sdkRoot "platforms;android-34" "build-tools;34.0.0" "platform-tools"
Write-Host "SDK install exit: $LASTEXITCODE"

# --- Update bubblewrap config.json ---
$configPath = "C:\Users\jmeny\.bubblewrap\config.json"
$config = @{
    jdkPath       = $JAVA_HOME
    androidSdkPath = $sdkRoot
} | ConvertTo-Json -Compress
$config | Out-File -FilePath $configPath -Encoding utf8 -NoNewline
Write-Host "Updated config.json:"
Get-Content $configPath

Write-Host "`nSDK setup complete. Run bubblewrap init again."
