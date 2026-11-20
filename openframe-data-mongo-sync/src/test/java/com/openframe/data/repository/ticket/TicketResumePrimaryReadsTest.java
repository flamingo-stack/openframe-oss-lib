package com.openframe.data.repository.ticket;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.data.mongodb.repository.ReadPreference;

import java.lang.reflect.Method;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

// An email resume re-reads rows its failed attempt wrote a moment ago; nothing else notices a lost annotation.
class TicketResumePrimaryReadsTest {

    @ParameterizedTest(name = "{0}")
    @MethodSource("resumeReads")
    void readPreference_resumeRead_primary(Method method) {
        // setup

        // execution
        ReadPreference readPreference = method.getAnnotation(ReadPreference.class);

        // verifications
        assertThat(readPreference).extracting(ReadPreference::value).isEqualTo("primary");
    }

    private static Stream<Arguments> resumeReads() throws NoSuchMethodException {
        return Stream.of(
                Arguments.of(TicketAttachmentRepository.class.getMethod("findByTicketIdAndStoragePathFromPrimary",
                        String.class, String.class)),
                Arguments.of(TicketNoteRepository.class.getMethod("existsByIdFromPrimary", String.class)));
    }
}
