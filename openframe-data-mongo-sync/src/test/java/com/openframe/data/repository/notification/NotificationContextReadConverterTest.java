package com.openframe.data.repository.notification;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.notification.NotificationContext;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

class NotificationContextReadConverterTest {

    @Test
    @DisplayName("Given a null source document, when converting, then null is returned without invoking Jackson")
    void given_null_source_when_converting_then_returns_null() {
        ObjectMapper objectMapper = mock(ObjectMapper.class);

        NotificationContextReadConverter converter = new NotificationContextReadConverter(objectMapper);

        assertThat(converter.convert(null)).isNull();
    }

    @Test
    @DisplayName("Given a malformed document, when Jackson fails, then IllegalStateException is raised carrying the document _id and type so the failure is diagnosable in production logs")
    void given_jackson_failure_when_converting_then_throws_with_id_and_type_in_message() throws IOException {
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        // JsonParseException extends IOException — using a subtype keeps Mockito happy
        // (IOException isn't declared on readValue(String, Class<T>)) while still
        // exercising the converter's IOException catch.
        given(objectMapper.readValue(anyString(), eq(NotificationContext.class)))
                .willThrow(new JsonParseException(null, "simulated parse failure"));

        NotificationContextReadConverter converter = new NotificationContextReadConverter(objectMapper);
        Document bad = new Document("_id", "doc-id-42").append("type", "weird-type");

        assertThatThrownBy(() -> converter.convert(bad))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("doc-id-42")
                .hasMessageContaining("weird-type")
                .hasCauseInstanceOf(IOException.class);
    }
}
