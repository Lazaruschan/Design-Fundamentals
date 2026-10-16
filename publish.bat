@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Publish the Design Fundamentals reading guide to GitHub Pages.
REM Repo: https://github.com/Lazaruschan/Design-Fundamentals
REM
REM Usage: double-click publish.bat
REM Token: set GITHUB_TOKEN first, or paste it when asked.
REM The token is used only for this run. It is not written into this file or the repo.
REM After push: Settings - Pages - Deploy from branch - main / (root)

cd /d "%~dp0"
set "DF_BAT_DIR=%~dp0"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"

set "REPO_URL=https://github.com/Lazaruschan/Design-Fundamentals.git"
set "BRANCH=main"
set "REMOTE=origin"
set "PAGES_URL=https://lazaruschan.github.io/Design-Fundamentals/"

echo ==^> Publishing from: %CD%
echo ==^> Target: %REPO_URL%

where git >nul 2>&1
if errorlevel 1 goto :no_git

call :load_token
if errorlevel 1 goto :fail

if not exist ".git" (
  echo ==^> git init
  git init
  if errorlevel 1 goto :fail
)

if exist ".git\rebase-merge" goto :rebase_busy
if exist ".git\rebase-apply" goto :rebase_busy
if exist ".git\MERGE_HEAD" goto :rebase_busy

call :ensure_identity
if errorlevel 1 goto :fail

> ".gitignore" (
echo .DS_Store
echo *.log
echo .env
echo .env.*
echo *token*
echo *secret*
echo github-token.txt
)

> ".nojekyll" echo.

echo ==^> Staging website files
git add -- .gitignore .nojekyll README.md publish.bat index.html css js design
for %%f in (*.html) do git add -- "%%f"
if exist "_build_site.py" git add -- "_build_site.py"
if errorlevel 1 goto :fail

git rm --cached --ignore-unmatch -- github-token.txt .env .env.local >nul 2>&1

echo ==^> Staged files:
git --no-pager status --short

git diff --cached --quiet
if errorlevel 1 goto :do_commit
git rev-parse HEAD >nul 2>&1
if errorlevel 1 goto :nothing
echo ==^> No new changes; will push existing commits.
goto :after_commit

:do_commit
echo ==^> Committing
git commit -m "Publish Design Fundamentals reading guide."
if errorlevel 1 goto :fail

:after_commit
git branch -M "%BRANCH%"
if errorlevel 1 goto :fail

git remote get-url "%REMOTE%" >nul 2>&1
if errorlevel 1 (
  echo ==^> Adding remote %REMOTE%
  git remote add "%REMOTE%" "%REPO_URL%"
) else (
  echo ==^> Updating remote %REMOTE%
  git remote set-url "%REMOTE%" "%REPO_URL%"
)
if errorlevel 1 goto :fail

call :sync_and_push
if errorlevel 1 goto :fail

echo.
echo Done.
echo Enable Pages ^(once^): repo Settings -^> Pages -^> Deploy from branch -^> main / ^(root^)
echo Site URL: %PAGES_URL%
call :maybe_pause
exit /b 0

:load_token
if defined GITHUB_TOKEN goto :token_ok
echo.
echo Paste a GitHub personal access token for Lazaruschan.
echo It is not saved. Create one at https://github.com/settings/tokens
set /p "GITHUB_TOKEN=Token: "
if not defined GITHUB_TOKEN (
  echo Error: no token entered.
  exit /b 1
)
:token_ok
exit /b 0

:ensure_identity
git config --get user.name >nul 2>&1
if errorlevel 1 git config user.name "Lazaruschan"
git config --get user.email >nul 2>&1
if errorlevel 1 git config user.email "Lazaruschan@users.noreply.github.com"
exit /b 0

:git_auth
REM Empty credential.helper stops Git Credential Manager from sending a saved
REM password that GitHub accepts instead of the token pasted for this run.
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=Never"
set "GIT_TRACE_CURL=1"
set "GIT_TRACE_CURL_NO_DATA=1"
set "DF_LOG=c:\Users\louis\OneDrive\0. 21_Education\SSHD2382 Design Fundamentals\debug-e9d749.log"
set "DF_OP=%1"
set "DF_PHASE=before"
REM #region agent log
powershell -NoProfile -File "%DF_BAT_DIR%debug-auth-log.ps1"
REM #endregion
git -c credential.helper= -c "http.extraHeader=AUTHORIZATION: bearer %GITHUB_TOKEN%" %* >"%TEMP%\df-git-out.txt" 2>"%TEMP%\df-git-err.txt"
set "GIT_RC=!ERRORLEVEL!"
set "DF_PHASE=after"
REM #region agent log
powershell -NoProfile -File "%DF_BAT_DIR%debug-auth-log.ps1"
REM #endregion
type "%TEMP%\df-git-out.txt"
findstr /i /c:"fatal:" /c:"remote:" /c:"invalid" /c:"Username" /c:"Authentication" "%TEMP%\df-git-err.txt" >&2
exit /b !GIT_RC!

:sync_and_push
echo ==^> Checking %REMOTE%
call :git_auth ls-remote "%REPO_URL%" "refs/heads/%BRANCH%" > "%TEMP%\df-guide-remote.txt"
if errorlevel 1 (
  echo Error: GitHub rejected the token, or the repo cannot be reached.
  echo The token needs repo access for Lazaruschan/Design-Fundamentals.
  echo A classic token needs the repo scope. A fine-grained token needs Contents: Read and write.
  del /q /f "%TEMP%\df-guide-remote.txt" >nul 2>&1
  exit /b 1
)
set "HAS_REMOTE="
for /f "usebackq delims=" %%i in ("%TEMP%\df-guide-remote.txt") do set "HAS_REMOTE=1"
del /q /f "%TEMP%\df-guide-remote.txt" >nul 2>&1

if not defined HAS_REMOTE (
  echo ==^> Remote branch is empty. Pushing %BRANCH%.
  goto :do_push
)

echo ==^> Syncing with %REMOTE%/%BRANCH%
call :git_auth fetch "%REMOTE%" "%BRANCH%"
if errorlevel 1 exit /b 1

set "BEHIND=0"
for /f %%i in ('git rev-list --count "HEAD..%REMOTE%/%BRANCH%" 2^>nul') do set "BEHIND=%%i"
if not "!BEHIND!"=="0" (
  echo ==^> Remote is ahead by !BEHIND! commit^(s^); rebasing onto %REMOTE%/%BRANCH%
  git rebase "%REMOTE%/%BRANCH%"
  if errorlevel 1 exit /b 1
)

:do_push
echo ==^> Pushing to %REMOTE%/%BRANCH%
call :git_auth push -u "%REMOTE%" "%BRANCH%"
if errorlevel 1 exit /b 1
exit /b 0

:no_git
echo Error: git is not installed. Install Git for Windows first.
call :maybe_pause
exit /b 1

:rebase_busy
echo Error: git rebase/merge in progress. Finish it ^(git rebase --continue^) or abort ^(git rebase --abort^), then re-run.
call :maybe_pause
exit /b 1

:nothing
echo Error: nothing to commit and no previous commits.
call :maybe_pause
exit /b 1

:fail
echo.
echo Publish failed.
call :maybe_pause
exit /b 1

:maybe_pause
if defined NO_PAUSE exit /b 0
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul
if not errorlevel 1 pause
exit /b 0
