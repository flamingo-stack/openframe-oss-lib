package com.openframe.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.ParameterNameDiscoverer;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.expression.ParseException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;
import org.springframework.util.ClassUtils;
import org.springframework.util.ReflectionUtils;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuditedMethodsCheck implements SmartInitializingSingleton {

    private static final Pattern VARIABLE = Pattern.compile("#(\\w+)");
    private static final Set<String> BUILT_IN_VARIABLES = Set.of("result", "root", "this");
    private static final Set<String> ASYNC_RESULTS = Set.of("java.util.concurrent.Future",
            "java.util.concurrent.CompletionStage", "org.reactivestreams.Publisher");
    private static final String DETAIL_SEPARATOR = "=";

    private final ConfigurableListableBeanFactory beanFactory;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final ParameterNameDiscoverer parameterNames = new DefaultParameterNameDiscoverer();

    @Override
    public void afterSingletonsInstantiated() {
        List<String> problems = new ArrayList<>();
        int checked = 0;
        for (String beanName : beanFactory.getBeanDefinitionNames()) {
            Class<?> type = beanFactory.getType(beanName, false);
            List<Method> audited = type == null ? List.of() : auditedMethodsOf(ClassUtils.getUserClass(type));
            if (audited.isEmpty() || isCreatedOnDemand(beanName)) {
                continue;
            }
            Object bean = beanFactory.getBean(beanName);
            audited.forEach(method -> problems.addAll(problemsOf(bean, method)));
            checked += audited.size();
        }
        Assert.state(problems.isEmpty(), () -> "@Audited methods that would record nothing or record wrong:\n"
                + String.join("\n", problems));
        log.info("Checked {} @Audited methods", checked);
    }

    private boolean isCreatedOnDemand(String beanName) {
        BeanDefinition definition = beanFactory.getBeanDefinition(beanName);
        return !definition.isSingleton() || definition.isLazyInit();
    }

    private static List<Method> auditedMethodsOf(Class<?> type) {
        return Arrays.stream(ReflectionUtils.getUniqueDeclaredMethods(type, method -> !method.isBridge()))
                .filter(method -> AnnotationUtils.findAnnotation(method, Audited.class) != null)
                .toList();
    }

    private List<String> problemsOf(Object bean, Method method) {
        String where = method.getDeclaringClass().getSimpleName() + "." + method.getName();
        List<String> problems = new ArrayList<>();
        int modifiers = method.getModifiers();
        if (!Modifier.isPublic(modifiers) || Modifier.isFinal(modifiers) || Modifier.isStatic(modifiers)) {
            problems.add(where + " must be public, not final and not static, or the aspect never sees it");
        }
        if (!method.isAnnotationPresent(Audited.class)) {
            problems.add(where + " inherits @Audited from an interface or an overridden method, which the aspect "
                    + "never sees; put it on the method itself");
        }
        if (!AopUtils.isAopProxy(bean)) {
            problems.add(where + " belongs to a bean that is not a Spring proxy, so its calls are never recorded");
        }
        if (returnsAsyncWork(method.getReturnType())) {
            problems.add(where + " returns work that finishes later, so the event would be written too early");
        }
        Audited audited = AnnotationUtils.findAnnotation(method, Audited.class);
        Arrays.stream(audited.details())
                .filter(detail -> !detail.contains(DETAIL_SEPARATOR))
                .forEach(detail -> problems.add(where + ": detail '" + detail
                        + "' has no key, write it as key = expression"));
        String[] names = parameterNames.getParameterNames(method);
        if (names == null) {
            problems.add(where + " was compiled without parameter names, so its expressions cannot read them");
            return problems;
        }
        Set<String> known = Set.of(names);
        boolean returnsNothing = method.getReturnType() == void.class;
        expressionsOf(audited)
                .forEach(expression -> problems.addAll(problemsOf(where, expression, known, returnsNothing)));
        return problems;
    }

    private List<String> problemsOf(String where, String expression, Set<String> parameters, boolean returnsNothing) {
        List<String> problems = new ArrayList<>();
        try {
            parser.parseExpression(expression);
        } catch (ParseException e) {
            problems.add(where + ": '" + expression + "' does not parse: " + e.getMessage());
            return problems;
        }
        Matcher variables = VARIABLE.matcher(expression);
        while (variables.find()) {
            String variable = variables.group(1);
            if (!parameters.contains(variable) && !BUILT_IN_VARIABLES.contains(variable)) {
                problems.add(where + ": '" + expression + "' names #" + variable + ", which the method does not have");
            }
            if ("result".equals(variable) && returnsNothing) {
                problems.add(where + ": '" + expression + "' reads #result, but the method returns nothing");
            }
        }
        return problems;
    }

    private static Stream<String> expressionsOf(Audited audited) {
        Stream<String> single = Stream.of(audited.targetId(), audited.condition(), audited.tenantId(),
                audited.targetName(), audited.organizationId(), audited.deviceId());
        Stream<String> details = Arrays.stream(audited.details())
                .map(detail -> detail.substring(detail.indexOf(DETAIL_SEPARATOR) + 1).trim());
        return Stream.concat(single, details).filter(StringUtils::hasText);
    }

    private static boolean returnsAsyncWork(Class<?> returnType) {
        return ASYNC_RESULTS.stream()
                .anyMatch(name -> ClassUtils.isPresent(name, returnType.getClassLoader())
                        && ClassUtils.resolveClassName(name, returnType.getClassLoader()).isAssignableFrom(returnType));
    }
}
