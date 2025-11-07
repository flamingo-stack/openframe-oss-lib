package com.openframe.authz.service.processor;

import com.openframe.data.document.auth.AuthUser;

public interface UserDeactivationProcessor {

    void postProcessDeactivation(AuthUser existing);

}
