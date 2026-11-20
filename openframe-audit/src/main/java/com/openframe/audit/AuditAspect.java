package com.openframe.audit;

import com.openframe.data.document.audit.AuditTargetType;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.aop.support.AopUtils;
import org.springframework.core.BridgeMethodResolver;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditedMethodRunner auditedMethodRunner;
    private final AuditExpressions expressions;

    @Around("@annotation(com.openframe.audit.Audited)")
    public Object capture(ProceedingJoinPoint joinPoint) throws Throwable {
        Method invoked = ((MethodSignature) joinPoint.getSignature()).getMethod();
        Method specific = AopUtils.getMostSpecificMethod(invoked, joinPoint.getTarget().getClass());
        Method method = Proxy.isProxyClass(specific.getDeclaringClass())
                ? BridgeMethodResolver.findBridgedMethod(invoked)
                : specific;
        Audited audited = AnnotationUtils.findAnnotation(method, Audited.class);
        Object[] arguments = joinPoint.getArgs();
        String idExpression = audited.targetId();
        String condition = audited.condition();
        boolean targetIdInResult = expressions.isFromResult(idExpression);
        AuditTargetType targetType = audited.targetType().length > 0
                ? audited.targetType()[0]
                : audited.action().getTargetType();
        AuditCall call = new AuditCall(
                audited.action(),
                targetType,
                () -> expressions.evaluate(idExpression, method, arguments, null),
                result -> expressions.evaluate(idExpression, method, arguments, result),
                targetIdInResult,
                result -> expressions.details(audited.details(), method, arguments, result),
                audited.compare(),
                false,
                result -> !StringUtils.hasText(condition) || expressions.isConditionMet(condition, method, arguments, result),
                result -> expressions.evaluate(audited.tenantId(), method, arguments, result),
                result -> expressions.evaluate(audited.targetName(), method, arguments, result),
                result -> expressions.evaluate(audited.organizationId(), method, arguments, result),
                result -> expressions.evaluate(audited.deviceId(), method, arguments, result));
        return auditedMethodRunner.run(call, joinPoint::proceed);
    }
}
