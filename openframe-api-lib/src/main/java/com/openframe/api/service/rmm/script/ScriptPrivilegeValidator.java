package com.openframe.api.service.rmm.script;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class ScriptPrivilegeValidator {

    private static final List<OsType> WINDOWS_ONLY = List.of(OsType.WINDOWS);

    public void validate(PrivilegeLevel privilegeLevel, List<OsType> supportedPlatforms) {
        if (privilegeLevel != PrivilegeLevel.ELEVATED_USER) {
            return;
        }
        if (isWindowsOnly(supportedPlatforms)) {
            return;
        }
        log.debug("Rejected privilege level {} for platforms {}", privilegeLevel, supportedPlatforms);
        throw new BadRequestException(ErrorCode.VALIDATION_ERROR,
                "ELEVATED_USER is supported only on Windows: supportedPlatforms must be [WINDOWS]");
    }

    private static boolean isWindowsOnly(List<OsType> supportedPlatforms) {
        return WINDOWS_ONLY.equals(supportedPlatforms);
    }
}
