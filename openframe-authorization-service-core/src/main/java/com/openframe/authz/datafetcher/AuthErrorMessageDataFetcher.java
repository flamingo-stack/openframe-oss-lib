package com.openframe.authz.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.authz.dto.AuthErrorDetail;
import com.openframe.authz.dto.AuthErrorMessage;
import com.openframe.authz.service.auth.AuthErrorMessageResolver;
import com.openframe.core.exception.AuthErrorCode;
import lombok.RequiredArgsConstructor;

// Served only by auth servers that ship the DGS starter: component scanning skips a class whose annotation it
// cannot load, so a deployment without DGS simply has no query. Public and pre-authentication by design.
@DgsComponent
@RequiredArgsConstructor
public class AuthErrorMessageDataFetcher {

    private final AuthErrorMessageResolver resolver;

    @DgsQuery
    public AuthErrorMessage authErrorMessage(@InputArgument String reference) {
        AuthErrorDetail detail = resolver.resolve(reference);
        AuthErrorCode code = detail.getCode();
        String name = code.name();
        String message = detail.getMessage();
        return new AuthErrorMessage(name, message);
    }
}
