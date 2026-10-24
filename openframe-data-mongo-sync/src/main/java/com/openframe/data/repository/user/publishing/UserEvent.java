package com.openframe.data.repository.user.publishing;

import com.openframe.publishing.api.spec.PublishedEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.stream.Collectors;
import java.util.stream.Stream;

// What consumers of events.users see. A proposal until stage 0 settles the public fields.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEvent implements PublishedEvent {

    private static final String NAME_SEPARATOR = " ";

    private String userId;
    private String firstName;
    private String lastName;

    // The name copies show. Not a getter, so not in the payload.
    public String fullName() {
        return fullName(firstName, lastName);
    }

    // The trimmed first and last name; either may be missing.
    public static String fullName(String firstName, String lastName) {
        return Stream.of(firstName, lastName)
                .filter(part -> part != null && !part.isBlank())
                .map(String::trim)
                .collect(Collectors.joining(NAME_SEPARATOR));
    }
}
