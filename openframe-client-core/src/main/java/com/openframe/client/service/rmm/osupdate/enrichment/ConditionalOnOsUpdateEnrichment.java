package com.openframe.client.service.rmm.osupdate.enrichment;

import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnExpression("'${openframe.rmm.os-update.enabled:false}' == 'true'"
        + " && '${openframe.rmm.os-update.enrichment.enabled:false}' == 'true'")
public @interface ConditionalOnOsUpdateEnrichment {
}
