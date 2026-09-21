package com.openframe.data.repository;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.organization.filter.OrganizationQueryFilter;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.filter.UserQueryFilter;
import com.openframe.data.repository.knowledgebase.CustomKnowledgeBaseItemRepositoryImpl;
import com.openframe.data.repository.organization.CustomOrganizationRepositoryImpl;
import com.openframe.data.repository.tool.CustomIntegratedToolRepositoryImpl;
import com.openframe.data.repository.user.CustomUserRepositoryImpl;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * User-supplied search input must never reach the Mongo regex engine unescaped:
 * unquoted patterns allow ReDoS inside mongod and force unindexed scans. Every
 * search site quotes with Pattern.quote (\Q...\E), so metacharacters match
 * literally. These tests pin that contract for the query builders.
 */
class SearchInputQuotingTest {

    private static final String HOSTILE = "(a+)+$";
    private static final String QUOTED = Pattern.quote(HOSTILE);

    private static Pattern fieldPattern(Object node, String field) {
        if (node instanceof Document doc) {
            if (doc.get(field) instanceof Pattern pattern) {
                return pattern;
            }
            return doc.values().stream()
                    .map(v -> fieldPattern(v, field))
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        if (node instanceof List<?> list) {
            return list.stream()
                    .map(v -> fieldPattern(v, field))
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private static void assertQuoted(Document query, String... fields) {
        for (String field : fields) {
            Pattern pattern = fieldPattern(query, field);
            assertThat(pattern).as(field).isNotNull();
            assertThat(pattern.pattern()).as(field).isEqualTo(QUOTED);
        }
    }

    @Test
    @DisplayName("organization search: name/organizationId/category clauses quote the input")
    void organizationSearchIsQuoted() {
        CustomOrganizationRepositoryImpl repo =
                new CustomOrganizationRepositoryImpl(mock(MongoTemplate.class));

        Document q = repo.buildOrganizationQuery(null, HOSTILE).getQueryObject();

        assertQuoted(q, "name", "organizationId", "category");
    }

    @Test
    @DisplayName("organization category filter: exact match stays anchored (^\\Q...\\E$) with the value quoted")
    void organizationCategoryFilterIsQuotedAndAnchored() {
        CustomOrganizationRepositoryImpl repo =
                new CustomOrganizationRepositoryImpl(mock(MongoTemplate.class));
        OrganizationQueryFilter filter = OrganizationQueryFilter.builder()
                .category(HOSTILE)
                .build();

        Document q = repo.buildOrganizationQuery(filter, null).getQueryObject();

        Pattern pattern = fieldPattern(q, "category");
        assertThat(pattern).isNotNull();
        assertThat(pattern.pattern()).isEqualTo("^" + QUOTED + "$");
    }


    @Test
    @DisplayName("integrated tool search: name and description clauses quote the input")
    void toolSearchIsQuoted() {
        CustomIntegratedToolRepositoryImpl repo =
                new CustomIntegratedToolRepositoryImpl(mock(MongoTemplate.class));

        Document q = repo.buildToolQuery(null, HOSTILE).getQueryObject();

        assertQuoted(q, "name", "description");
    }

    @Test
    @DisplayName("user search: the email/name filters are quoted before hitting the regex engine, despite their legacy Regex names")
    void userSearchIsQuoted() {
        MongoTemplate template = mock(MongoTemplate.class);
        CustomUserRepositoryImpl repo = new CustomUserRepositoryImpl(template);
        UserQueryFilter filter = UserQueryFilter.builder()
                .emailRegex(HOSTILE)
                .nameRegex(HOSTILE)
                .build();

        repo.findUsersBySearch(filter, 10);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(User.class));
        assertQuoted(captor.getValue().getQueryObject(), "email", "firstName", "lastName");
    }

    @Test
    @DisplayName("knowledge base folder search: name clause quotes the input")
    void knowledgeBaseSearchIsQuoted() {
        MongoTemplate template = mock(MongoTemplate.class);
        CustomKnowledgeBaseItemRepositoryImpl repo = new CustomKnowledgeBaseItemRepositoryImpl(template);

        repo.findFoldersForParent(null, HOSTILE, null);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(KnowledgeBaseItem.class));
        assertQuoted(captor.getValue().getQueryObject(), "name");
    }
}
