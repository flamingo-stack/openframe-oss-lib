package com.openframe.data.repository.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationContext;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class NotificationContextWriteConverterTest {

    @Test
    @DisplayName("Given a null source context, when converting, then null is returned without invoking Jackson")
    void given_null_source_when_converting_then_returns_null() {
        ObjectMapper objectMapper = mock(ObjectMapper.class);

        NotificationContextWriteConverter converter = new NotificationContextWriteConverter(objectMapper);

        assertThat(converter.convert(null)).isNull();
    }

    @Test
    @DisplayName("Given a populated GenericContext, when converting, then a BSON document carries the discriminator and payload")
    void given_generic_context_when_converting_then_document_contains_type_and_payload() {
        ObjectMapper objectMapper = new ObjectMapper();
        GenericContext source = GenericContext.builder()
                .type("GENERIC")
                .payload("hello")
                .build();

        NotificationContextWriteConverter converter = new NotificationContextWriteConverter(objectMapper);

        Document result = converter.convert(source);

        assertThat(result).isNotNull();
        assertThat(result.getString("type")).isEqualTo("GENERIC");
        assertThat(result.getString("payload")).isEqualTo("hello");
    }

    @Test
    @DisplayName("Given a Jackson serialisation failure, when converting, then IllegalStateException is raised carrying the discriminator so the failure is diagnosable in production logs")
    void given_jackson_failure_when_converting_then_throws_with_type_in_message() throws JsonProcessingException {
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        NotificationContext source = GenericContext.builder()
                .type("EXOTIC_TYPE")
                .payload("ignored")
                .build();

        given(objectMapper.writeValueAsString(any())).willThrow(new JsonProcessingException("simulated") {});

        NotificationContextWriteConverter converter = new NotificationContextWriteConverter(objectMapper);

        assertThatThrownBy(() -> converter.convert(source))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EXOTIC_TYPE")
                .hasCauseInstanceOf(JsonProcessingException.class);
    }
}
