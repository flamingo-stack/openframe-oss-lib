package com.openframe.authz.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthErrorMessage {

    private final String code;
    private final String message;
}
