package com.openframe.api.exception;

public class UserSelfDeleteNotAllowedException extends RuntimeException {
    public UserSelfDeleteNotAllowedException(String message) {
        super(message);
    }
}
