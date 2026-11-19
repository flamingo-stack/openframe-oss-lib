package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {

    AuditAction action();

    String targetId() default "";

    AuditTargetType[] targetType() default {};

    String[] details() default {};

    boolean compare() default true;

    String condition() default "";

    String tenantId() default "";

    String targetName() default "";

    String organizationId() default "";

    String deviceId() default "";
}
