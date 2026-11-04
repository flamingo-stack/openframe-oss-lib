package com.openframe.core.dto;

import java.util.List;

public interface HasUserErrors {

    List<String> userErrorMessages();

    default boolean isPlatformFailure() {
        return false;
    }
}
