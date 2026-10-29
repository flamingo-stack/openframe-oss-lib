package com.openframe.api.schema;

import com.openframe.data.document.notification.NotificationCategory;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

// A category the Java enum knows and the schema does not is invisible until a notification actually
// carries it, and then the whole list fails to serialize for every user, not just that one row.
class NotificationCategorySchemaTest {

    private static final String SCHEMA_RESOURCE = "/schema/notification.graphqls";
    private static final Pattern ENUM_BODY =
            Pattern.compile("enum\\s+NotificationCategory\\s*\\{([^}]*)}", Pattern.DOTALL);

    @Test
    void theSchemaOffersEveryCategoryTheEnumCanProduce() {
        List<String> declared = categoriesInSchema();

        List<String> known = Arrays.stream(NotificationCategory.values())
                .map(Enum::name)
                .toList();

        assertThat(declared).containsExactlyElementsOf(known);
    }

    private List<String> categoriesInSchema() {
        String schema = readSchema();
        Matcher matcher = ENUM_BODY.matcher(schema);
        assertThat(matcher.find()).as("NotificationCategory is declared in %s", SCHEMA_RESOURCE).isTrue();

        String body = matcher.group(1);
        return body.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .filter(line -> !line.startsWith("#"))
                .toList();
    }

    private String readSchema() {
        try (InputStream stream = getClass().getResourceAsStream(SCHEMA_RESOURCE)) {
            assertThat(stream).as("%s is on the test classpath", SCHEMA_RESOURCE).isNotNull();
            byte[] bytes = stream.readAllBytes();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Could not read " + SCHEMA_RESOURCE, e);
        }
    }
}
