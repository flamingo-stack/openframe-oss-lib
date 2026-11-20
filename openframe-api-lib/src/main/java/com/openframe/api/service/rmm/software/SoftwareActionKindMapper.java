package com.openframe.api.service.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import lombok.experimental.UtilityClass;

@UtilityClass
public class SoftwareActionKindMapper {

    public SoftwareActionKind kindOf(SoftwareAction action) {
        return switch (action) {
            case INSTALL -> SoftwareActionKind.INSTALL;
            case UPDATE -> SoftwareActionKind.UPDATE;
            case ADOPT -> SoftwareActionKind.ADOPT;
        };
    }
}
