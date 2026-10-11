; Close the installed TideStudio before NSIS replaces or removes its files.
; Prefer the application's own shutdown (which stops model workers and the API
; gateway). Restart Manager handles older versions without this argument.
!macro CloseRunningTideStudio
  !define CloseRunId ${__LINE__}

  IfFileExists "$INSTDIR\tidestudio.exe" 0 close_done_${CloseRunId}

  !insertmacro RestartManager_StartSession $R0
  ${If} $R0 != ""
    !insertmacro RestartManager_RegisterFile $R0 "$INSTDIR\tidestudio.exe"
    ${If} $0 = 0
      System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
      ${If} $0 = ${ERROR_MORE_DATA}
        ; A second TideStudio instance forwards the argument to the existing one.
        ExecWait '"$INSTDIR\tidestudio.exe" --quit-for-install' $R1

        StrCpy $R2 0
        close_wait_${CloseRunId}:
          Sleep 250
          System::Call 'RSTRTMGR::RmGetList(p R0, *i .r1, *i .r2, p 0, *i .r3) i .r0'
          ${If} $0 = ${ERROR_MORE_DATA}
            IntOp $R2 $R2 + 1
            ${If} $R2 < 80
              Goto close_wait_${CloseRunId}
            ${EndIf}

            ; Old installed versions may ignore --quit-for-install. Restrict
            ; forced shutdown to processes registered against this install path.
            System::Call 'RSTRTMGR::RmShutdown(p R0, i ${RmForceShutdown}, p 0) i .r0'
          ${EndIf}
      ${EndIf}
    ${EndIf}
    !insertmacro RestartManager_EndSession $R0
  ${EndIf}

  close_done_${CloseRunId}:
  !undef CloseRunId
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro CloseRunningTideStudio
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro CloseRunningTideStudio
!macroend
