package com.openframe.data.document.device;

// Who the machine is tied to in a directory: PRIMARY is one user, SHARED is several, NONE is nobody. A machine an external
// directory integration never wrote (every machine in OSS) has no value, and every reader takes that as NONE.
public enum DirectoryUserLink {
    PRIMARY,
    SHARED,
    NONE
}
