package com.openframe.audit.targets;

import java.util.List;

public interface AuditTargetCatalog {

    List<AuditTarget<?>> targets();
}
