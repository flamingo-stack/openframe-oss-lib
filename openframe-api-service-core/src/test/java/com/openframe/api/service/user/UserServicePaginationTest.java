package com.openframe.api.service.user;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import com.openframe.data.repository.user.UserListFilter;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServicePaginationTest {

    private static final String USER_1 = "u-1";
    private static final String USER_2 = "u-2";
    private static final String USER_3 = "u-3";
    private static final String USER_4 = "u-4";
    private static final String USER_5 = "u-5";
    private static final String INVALID_CURSOR = "Invalid cursor";
    private static final UserListFilter NO_FILTER = new UserListFilter(null, null, null, null);

    @Mock private UserRepository userRepository;
    @Mock private SsoIdentityRepository ssoIdentityRepository;
    @Mock private UserProcessor userProcessor;
    @Mock private EmailService emailService;
    @Spy private UserMapper userMapper = new UserMapper();

    @InjectMocks private UserService service;

    @Test
    void queryUsers_pageOneThenPageTwoThenBeforePageTwo_returnsPageOneAgain() {
        // setup
        stubUserPages();

        // execution
        CountedGenericQueryResult<UserResponse> pageOne = service.queryUsers(null, null, forward(2, null));
        CountedGenericQueryResult<UserResponse> pageTwo =
                service.queryUsers(null, null, forward(2, pageOne.getPageInfo().getEndCursor()));
        CountedGenericQueryResult<UserResponse> backToPageOne =
                service.queryUsers(null, null, backward(2, pageTwo.getPageInfo().getStartCursor()));

        // verifications
        assertThat(pageOne.getItems()).extracting(UserResponse::getId).containsExactly(USER_1, USER_2);
        assertThat(pageTwo.getItems()).extracting(UserResponse::getId).containsExactly(USER_3, USER_4);
        assertThat(backToPageOne.getItems()).extracting(UserResponse::getId).containsExactly(USER_1, USER_2);
        assertThat(backToPageOne.getPageInfo())
                .returns(pageOne.getPageInfo().getStartCursor(), PageInfo::getStartCursor)
                .returns(pageOne.getPageInfo().getEndCursor(), PageInfo::getEndCursor);
    }

    @ParameterizedTest
    @MethodSource("pagesOfFiveRows")
    void queryUsers_eachPageInEachDirection_rowsInDisplayOrderWithBothFlags(
            boolean backward, int anchorRow, List<String> expectedRows, boolean hasPreviousPage, boolean hasNextPage) {
        // setup
        stubUserPages();
        String cursor = cursorOfRow(anchorRow);
        CursorPaginationCriteria pagination = connectionPage(backward, 2, cursor);

        // execution
        CountedGenericQueryResult<UserResponse> result = service.queryUsers(null, null, pagination);

        // verifications
        assertThat(result.getItems()).extracting(UserResponse::getId).containsExactlyElementsOf(expectedRows);
        assertThat(result.getPageInfo())
                .returns(hasPreviousPage, PageInfo::isHasPreviousPage)
                .returns(hasNextPage, PageInfo::isHasNextPage);
    }

    @Test
    void queryUsers_lastWithoutBefore_lastRowsInDisplayOrderAndNoNextPage() {
        // setup
        stubUserPages();

        // execution
        CountedGenericQueryResult<UserResponse> result = service.queryUsers(null, null, backward(2, null));

        // verifications
        assertThat(result.getItems()).extracting(UserResponse::getId).containsExactly(USER_4, USER_5);
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(true, PageInfo::isHasPreviousPage);
        verify(userRepository).findUsersPage(NO_FILTER, null, true, 3);
    }

    @Test
    void queryUsers_backwardPage_pageInfoCursorsKeepTheEmailAndIdFormat() {
        // setup
        stubUserPages();

        // execution
        PageInfo pageInfo = service.queryUsers(null, null, backward(2, null)).getPageInfo();

        // verifications
        assertThat(CursorCodec.decode(pageInfo.getStartCursor())).isEqualTo("c_d@acme.io_u-4");
        assertThat(CursorCodec.decode(pageInfo.getEndCursor())).isEqualTo("d@acme.io_u-5");
    }

    @Test
    void queryUsers_cursorTheRepositoryRejects_throwsInvalidCursor() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("not-a-user-cursor").build();
        when(userRepository.findUsersPage(NO_FILTER, "not-a-user-cursor", false, 3))
                .thenThrow(new InvalidCursorException());

        // execution
        Throwable thrown = catchThrowable(() -> service.queryUsers(null, null, pagination));

        // verifications
        assertThat(thrown).isInstanceOf(InvalidCursorException.class).hasMessage(INVALID_CURSOR);
    }

    private static Stream<Arguments> pagesOfFiveRows() {
        return Stream.of(
                arguments(false, 0, List.of(USER_1, USER_2), false, true),
                arguments(false, 2, List.of(USER_3, USER_4), true, true),
                arguments(false, 4, List.of(USER_5), true, false),
                arguments(false, 5, List.of(), true, false),
                arguments(true, 0, List.of(USER_4, USER_5), true, false),
                arguments(true, 5, List.of(USER_3, USER_4), true, true),
                arguments(true, 3, List.of(USER_1, USER_2), false, true),
                arguments(true, 2, List.of(USER_1), false, true),
                arguments(true, 1, List.of(), false, true));
    }

    private static CursorPaginationCriteria forward(int first, String after) {
        ConnectionArgs args = ConnectionArgs.builder().first(first).after(after).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria backward(int last, String before) {
        ConnectionArgs args = ConnectionArgs.builder().last(last).before(before).build();
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    private static CursorPaginationCriteria connectionPage(boolean backward, int limit, String cursor) {
        return backward ? backward(limit, cursor) : forward(limit, cursor);
    }

    private static List<User> users() {
        return List.of(
                user(USER_1, "a@acme.io"),
                user(USER_2, "b@acme.io"),
                user(USER_3, "b@acme.io"),
                user(USER_4, "c_d@acme.io"),
                user(USER_5, "d@acme.io"));
    }

    private static User user(String id, String email) {
        return User.builder().id(id).email(email).status(UserStatus.ACTIVE).roles(List.of(UserRole.ADMIN)).build();
    }

    private static String cursorOfRow(int row) {
        return row == 0 ? null : CursorCodec.encode(emailAndIdOf(users().get(row - 1)));
    }

    private static String emailAndIdOf(User user) {
        return user.getEmail() + "_" + user.getId();
    }

    private static List<User> usersPast(String cursor, boolean backward, int limit) {
        Comparator<User> displayOrder = Comparator.comparing(User::getEmail).thenComparing(User::getId);
        Comparator<User> fetchOrder = backward ? displayOrder.reversed() : displayOrder;
        Optional<User> anchor = Optional.ofNullable(cursor).map(UserServicePaginationTest::anchorOf);
        return users().stream()
                .sorted(fetchOrder)
                .filter(row -> anchor.map(past -> fetchOrder.compare(row, past) > 0).orElse(true))
                .limit(limit)
                .toList();
    }

    private static User anchorOf(String emailAndId) {
        int idStart = emailAndId.lastIndexOf('_');
        return user(emailAndId.substring(idStart + 1), emailAndId.substring(0, idStart));
    }

    private void stubUserPages() {
        when(userRepository.findUsersPage(eq(NO_FILTER), nullable(String.class), anyBoolean(), anyInt()))
                .thenAnswer(call -> usersPast(call.getArgument(1), call.getArgument(2), call.getArgument(3)));
    }
}
