//go:build windows

package main

import (
	"fmt"
	"syscall"
)

var (
	kernel32            = syscall.NewLazyDLL("kernel32.dll")
	openProcess         = kernel32.NewProc("OpenProcess")
	waitForSingleObject = kernel32.NewProc("WaitForSingleObject")
	closeHandle         = kernel32.NewProc("CloseHandle")
)

const (
	synchronizeAccess uint32  = 0x00100000
	waitObject0       uintptr = 0
	waitFailed        uintptr = 0xFFFFFFFF
	waitInfinite      uintptr = 0xFFFFFFFF
)

// watchParentExit retains an OS handle so PID reuse cannot make the watcher
// track a different process after the owning TideStudio instance exits.
func watchParentExit(pid uint32, onExit func()) error {
	handle, _, err := openProcess.Call(uintptr(synchronizeAccess), 0, uintptr(pid))
	if handle == 0 {
		return fmt.Errorf("open parent process %d: %w", pid, err)
	}

	go func() {
		defer closeHandle.Call(handle)
		status, _, _ := waitForSingleObject.Call(handle, waitInfinite)
		if status == waitObject0 || status == waitFailed {
			onExit()
		}
	}()
	return nil
}
