package com.openframe.audit;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.context.ApplicationContext;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.method.ControllerAdviceBean;
import org.springframework.web.method.annotation.ExceptionHandlerMethodResolver;

import java.lang.reflect.AnnotatedElement;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

@Component
@RequiredArgsConstructor
public class ExceptionHandlerStatuses implements SmartInitializingSingleton {

    private final ApplicationContext applicationContext;
    private List<ExceptionHandlerMethodResolver> exceptionHandlers = List.of();

    @Override
    public void afterSingletonsInstantiated() {
        exceptionHandlers = ControllerAdviceBean.findAnnotatedBeans(applicationContext).stream()
                .map(ControllerAdviceBean::getBeanType)
                .filter(Objects::nonNull)
                .map(ExceptionHandlerMethodResolver::new)
                .toList();
    }

    public Optional<HttpStatusCode> statusOf(Throwable failure) {
        Stream<AnnotatedElement> handlerMethods = exceptionHandlers.stream()
                .<AnnotatedElement>map(handlers -> handlers.resolveMethodByThrowable(failure))
                .filter(Objects::nonNull);
        return Stream.concat(Stream.of(failure.getClass()), handlerMethods)
                .map(element -> AnnotatedElementUtils.findMergedAnnotation(element, ResponseStatus.class))
                .filter(Objects::nonNull)
                .findFirst()
                .map(ResponseStatus::code);
    }
}
