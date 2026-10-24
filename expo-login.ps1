# Signs Expo CLI in to your Expo account (Expo Go requires it).
# BROWSER=none: Expo's auto-open crashes on Windows, so it prints the login link instead.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:BROWSER = 'none'
Set-Location $PSScriptRoot
npx expo login
npx expo whoami
