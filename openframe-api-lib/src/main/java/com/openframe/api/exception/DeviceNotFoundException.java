package com.openframe.api.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class DeviceNotFoundException extends NotFoundException {

    public DeviceNotFoundException(String message) {
        super(ErrorCode.DEVICE_NOT_FOUND, message);
    }
}
