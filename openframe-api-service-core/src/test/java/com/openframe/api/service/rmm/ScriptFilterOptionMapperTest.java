package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.ScriptFilterOption;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptFilterOptionMapperTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ScriptFilterOptionMapper mapper;

    @Test
    @DisplayName("selfLabeled: value == label == the raw key; count preserved")
    void selfLabeled_valueEqualsLabel() {
        List<ScriptFilterOption> options = mapper.selfLabeled(Map.of("BASH", 3));

        assertThat(options).singleElement().satisfies(o -> {
            assertThat(o.getValue()).isEqualTo("BASH");
            assertThat(o.getLabel()).isEqualTo("BASH");
            assertThat(o.getCount()).isEqualTo(3);
        });
    }

    @Test
    @DisplayName("userLabeled: resolves label as full name, then email, then the id when both are blank")
    void userLabeled_labelFallbacks() {
        when(userRepository.findAllById(any())).thenReturn(List.of(
                user("u-1", "Neo", "Anderson", "neo@example.com"),  // full name wins
                user("u-2", null, null, "trinity@example.com"),     // no name → email
                user("u-3", "  ", null, null)));                     // blank name + no email → id

        List<ScriptFilterOption> options = mapper.userLabeled(Map.of("u-1", 4, "u-2", 2, "u-3", 1));

        assertThat(options)
                .anySatisfy(o -> { assertThat(o.getValue()).isEqualTo("u-1"); assertThat(o.getLabel()).isEqualTo("Neo Anderson"); })
                .anySatisfy(o -> { assertThat(o.getValue()).isEqualTo("u-2"); assertThat(o.getLabel()).isEqualTo("trinity@example.com"); })
                .anySatisfy(o -> { assertThat(o.getValue()).isEqualTo("u-3"); assertThat(o.getLabel()).isEqualTo("u-3"); });
    }

    @Test
    @DisplayName("userLabeled: missing user (no row) falls back to the id as label")
    void userLabeled_missingUser_fallsBackToId() {
        when(userRepository.findAllById(any())).thenReturn(List.of());   // none resolved

        List<ScriptFilterOption> options = mapper.userLabeled(Map.of("ghost", 1));

        assertThat(options).singleElement().satisfies(o -> {
            assertThat(o.getValue()).isEqualTo("ghost");
            assertThat(o.getLabel()).isEqualTo("ghost");
        });
    }

    @Test
    @DisplayName("userLabeled: empty input → empty list and NO user lookup")
    void userLabeled_empty_skipsLookup() {
        assertThat(mapper.userLabeled(Map.of())).isEmpty();
        verifyNoInteractions(userRepository);
    }

    private static User user(String id, String first, String last, String email) {
        User u = new User();
        u.setId(id);
        u.setFirstName(first);
        u.setLastName(last);
        u.setEmail(email);
        return u;
    }
}
