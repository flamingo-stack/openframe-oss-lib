package com.openframe.authz.service.auth;

import com.openframe.authz.dto.AuthErrorDetail;
import com.openframe.core.exception.AuthErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import static com.openframe.core.exception.AuthErrorCode.UNEXPECTED;

// A reference is either a catalog code name or the 8-character key of a stored dynamic message; anything else,
// and an expired key, is the generic entry.
@Service
@RequiredArgsConstructor
public class AuthErrorMessageResolver {

    private final AuthErrorDetailStore detailStore;

    public AuthErrorDetail resolve(String reference) {
        if (AuthErrorDetailStore.isReference(reference)) {
            return detailStore.find(reference).orElseGet(AuthErrorMessageResolver::generic);
        }
        AuthErrorCode code = AuthErrorCode.fromName(reference);
        return catalogEntry(code);
    }

    private static AuthErrorDetail catalogEntry(AuthErrorCode code) {
        String message = code.getMessage();
        return new AuthErrorDetail(code, message);
    }

    private static AuthErrorDetail generic() {
        return catalogEntry(UNEXPECTED);
    }
}
