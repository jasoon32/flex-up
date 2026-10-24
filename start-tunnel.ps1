# Starts the Expo dev server over a tunnel so Expo Go can connect from any network.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location $PSScriptRoot
npx expo start --tunnel ngrok
