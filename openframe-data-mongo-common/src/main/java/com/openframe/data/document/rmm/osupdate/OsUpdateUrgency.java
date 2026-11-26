package com.openframe.data.document.rmm.osupdate;

// The rows of a policy: how fast an update is rolled out and how long its restart may wait.
public enum OsUpdateUrgency {
    CRITICAL_SECURITY,
    OTHER_SECURITY,
    QUALITY
}
