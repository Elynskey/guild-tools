; Ensures a running Guild Tools instance can't lock files the installer needs to
; overwrite -- previously an officer had to manually close the app before every
; update; now the installer does it itself, both on install (fresh setup or update)
; and uninstall.
!macro customInit
  nsExec::Exec 'taskkill /F /IM "Guild Tools.exe"'
!macroend

!macro customUnInstall
  nsExec::Exec 'taskkill /F /IM "Guild Tools.exe"'
!macroend
