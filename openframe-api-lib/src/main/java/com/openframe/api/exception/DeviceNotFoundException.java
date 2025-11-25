package com.openframe.api.exception;

public class DeviceNotFoundException extends RuntimeException {
	public DeviceNotFoundException(String message) {
		super(message);
	}
}
