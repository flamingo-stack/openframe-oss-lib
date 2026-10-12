package com.openframe.authz.dto;

import com.openframe.core.exception.AuthErrorCode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthErrorDetail {

    private AuthErrorCode code;
    private String message;
}
