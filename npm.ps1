$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node "$scriptDir\dev-runner.js" @args
