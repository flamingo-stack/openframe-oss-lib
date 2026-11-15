package com.openframe.audit.targets;

import java.util.List;

public interface AuditTargetProvider {

    List<AuditTarget<?>> targets();
}
