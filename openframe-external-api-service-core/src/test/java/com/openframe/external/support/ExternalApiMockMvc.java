package com.openframe.external.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.external.config.ExternalApiJacksonConfig;
import com.openframe.external.exception.GlobalExceptionHandler;
import com.openframe.external.web.ApiCallerArgumentResolver;
import org.springframework.http.converter.ByteArrayHttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.validation.beanvalidation.MethodValidationPostProcessor;

import java.util.Arrays;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Standalone MockMvc wired like the deployed external API: gateway identity headers bound to
 * {@code ApiCaller}, both exception handlers, bean validation and the module's Jackson setup.
 */
public final class ExternalApiMockMvc {

    public static final String USER_ID = "user-1";
    public static final String API_KEY_ID = "ak_test";

    private ExternalApiMockMvc() {
    }

    public static MockMvc standalone(Object... controllers) {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        // The controllers are @Validated, so in the app their @RequestParam constraints are enforced
        // by this post-processor's proxy; standalone MockMvc has no context to apply it.
        MethodValidationPostProcessor methodValidation = new MethodValidationPostProcessor();
        methodValidation.setValidator(validator);
        methodValidation.afterPropertiesSet();
        Object[] validated = Arrays.stream(controllers)
                .map(c -> methodValidation.postProcessAfterInitialization(c, c.getClass().getSimpleName()))
                .toArray();

        return MockMvcBuilders.standaloneSetup(validated)
                .setCustomArgumentResolvers(new ApiCallerArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler(), new BaseGlobalExceptionHandler())
                .setMessageConverters(
                        new ByteArrayHttpMessageConverter(),
                        new StringHttpMessageConverter(),
                        new MappingJackson2HttpMessageConverter(objectMapper()))
                .setValidator(validator)
                .defaultRequest(get("/").header(X_USER_ID, USER_ID).header(X_API_KEY_ID, API_KEY_ID))
                .build();
    }

    /** ObjectMapper with the module's customizer applied, for building request bodies and reading responses. */
    public static ObjectMapper objectMapper() {
        // Same defaults Spring Boot's Jackson auto-configuration applies before the customizers run.
        Jackson2ObjectMapperBuilder builder = Jackson2ObjectMapperBuilder.json()
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
                        SerializationFeature.WRITE_DURATIONS_AS_TIMESTAMPS);
        new ExternalApiJacksonConfig().externalApiInstantMillisCustomizer().customize(builder);
        return builder.build();
    }
}
