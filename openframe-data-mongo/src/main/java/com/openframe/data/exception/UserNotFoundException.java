package com.openframe.data.exception;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String userId)
    {
        super("User not found: " + userId);
    }
}


