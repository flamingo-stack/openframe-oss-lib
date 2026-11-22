package com.openframe.authz.service.processor;

import com.openframe.authz.dto.TenantRegistrationRequest;

/** Allows a deployment to accept password signup without disclosing the account or authenticating the browser. */
public interface PasswordSignupProcessor {

    void acceptPasswordSignup(TenantRegistrationRequest request);
}
