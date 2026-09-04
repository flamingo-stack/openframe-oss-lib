package com.openframe.authz.event;

import com.openframe.data.document.tenant.Tenant;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class TenantRegisteredEvent extends ApplicationEvent {

    private final Tenant tenant;

    public TenantRegisteredEvent(Object source, Tenant tenant) {
        super(source);
        this.tenant = tenant;
    }
}
