package com.openframe.test.config;

/**
 * Operating system of the SSH verification target. Selects the shell dialect used to build verification
 * commands (POSIX shell vs Windows PowerShell) and the default temp-file location. The provisioned test
 * fleet is Windows (OpenSSH with PowerShell as the default shell, port 222).
 */
public enum MachineOs {
    LINUX,
    WINDOWS
}
