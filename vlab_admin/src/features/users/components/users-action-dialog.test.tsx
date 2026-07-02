import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type UserEvent, userEvent } from 'vitest/browser'
import { type User } from '../data/schema'
import { UsersActionDialog } from './users-action-dialog'

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()
vi.mock('../api/useUsersMutations', () => ({
  useUserMutations: () => ({
    createUser: {
      mutate: mockCreateMutate
    },
    updateUser: {
      mutate: mockUpdateMutate
    }
  })
}))

const VALIDATION_MESSAGES = {
  FullName: 'Full Name is required.',
  Email: 'Email is required.',
  Role: 'Role is required.',
  password: 'Password is required.',
  passwordMismatch: "Passwords don't match.",
  passwordLength: 'Password must be at least 8 characters long.',
  passwordNumber: 'Password must contain at least one number.',
  passwordLowercase: 'Password must contain at least one lowercase letter.',
} as const

const MOCK_USER: User = {
  UserId: 123,
  FullName: 'Alex Smith',
  Email: 'alex@smith.com',
  PhoneNumber: '+19999999999',
  Role: 'admin',
  EnrollmentNumber: 'alex_smith',
  CreditBalance: 0,
  CreatedAt: '2026-01-01',
}

describe('UsersActionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('add user', () => {
    it('renders title and description', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )

      const title = getByRole('heading', {
        level: 2,
        name: /Add New User/i,
      })
      const description = getByText(
        /Create new user here. Click save when you're done./i
      )

      await expect.element(title).toBeInTheDocument()
      await expect.element(description).toBeInTheDocument()
    })

    it('shows validation messages when the form is submitted with empty fields', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )

      const submitButton = getByRole('button', { name: /Save Changes/i })
      await userEvent.click(submitButton)

      await expect
        .element(getByText(VALIDATION_MESSAGES.FullName))
        .toBeInTheDocument()
      await expect
        .element(getByText(VALIDATION_MESSAGES.Email))
        .toBeInTheDocument()
      await expect
        .element(getByText(VALIDATION_MESSAGES.Role))
        .toBeInTheDocument()
      await expect
        .element(getByText(VALIDATION_MESSAGES.password))
        .toBeInTheDocument()
    })

    it('keeps confirm password disabled until password field is touched', async () => {
      const { getByLabelText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )

      const password = getByLabelText(/^Password$/i)
      const confirmPassword = getByLabelText(/Confirm Password/i)
      await expect.element(confirmPassword).toBeDisabled()

      await userEvent.type(password, 'a')
      await expect.element(confirmPassword).toBeEnabled()
    })

    it('shows password validation messages when password is invalid', async () => {
      const { getByLabelText, getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} />
      )

      const password = getByLabelText(/^Password$/i)
      const confirmPassword = getByLabelText(/Confirm Password/i)
      await userEvent.type(password, 'a')
      await userEvent.type(confirmPassword, 'b')
      const submitButton = getByRole('button', { name: /Save Changes/i })

      await userEvent.click(submitButton)

      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordMismatch))
        .toBeInTheDocument()

      await userEvent.fill(password, 'short')

      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLength))
        .toBeInTheDocument()

      await userEvent.fill(password, 'ONLYUPPERCASE')

      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLowercase))
        .toBeInTheDocument()

      await userEvent.fill(password, 'onlylowercase')

      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordNumber))
        .toBeInTheDocument()

      await userEvent.fill(password, 'S3cur3P@ssw0rd')
      await userEvent.fill(confirmPassword, 'S3cur3P@ssw0rd')

      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordMismatch))
        .not.toBeInTheDocument()
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordLength))
        .not.toBeInTheDocument()
      await expect
        .element(getByText(VALIDATION_MESSAGES.passwordNumber))
        .not.toBeInTheDocument()
    })

    it('calls createUser mutation when form is submitted successfully', async () => {
      const onOpenChange = vi.fn()

      const screen = await render(
        <UsersActionDialog open onOpenChange={onOpenChange} />
      )

      await fillRequiredProfileFields(userEvent, screen, MOCK_USER)
      await fillPasswords(userEvent, screen, 'S3cur3P@ssw0rd', 'S3cur3P@ssw0rd')

      const submitButton = screen.getByRole('button', { name: /Save Changes/i })
      await userEvent.click(submitButton)

      expect(mockCreateMutate).toHaveBeenCalledOnce()
      expect(mockCreateMutate.mock.calls[0][0]).toEqual({
        FullName: MOCK_USER.FullName,
        Email: MOCK_USER.Email,
        Role: MOCK_USER.Role,
        PhoneNumber: MOCK_USER.PhoneNumber,
        EnrollmentNumber: MOCK_USER.EnrollmentNumber,
        ProgramId: undefined,
        SemesterId: undefined,
        CreditBalance: 0,
        password: 'S3cur3P@ssw0rd',
        confirmPassword: 'S3cur3P@ssw0rd',
        isEdit: false,
      })
    })
  })

  describe('edit user', () => {
    it('renders title and description', async () => {
      const { getByRole, getByText } = await render(
        <UsersActionDialog open onOpenChange={vi.fn()} currentRow={MOCK_USER} />
      )

      const title = getByRole('heading', {
        level: 2,
        name: /Edit User/i,
      })
      const description = getByText(
        /Update the user here\. Click save when you're done\./i
      )

      await expect.element(title).toBeInTheDocument()
      await expect.element(description).toBeInTheDocument()
    })

    it('submits without password changes', async () => {
      const onOpenChange = vi.fn()
      const screen = await render(
        <UsersActionDialog
          open
          onOpenChange={onOpenChange}
          currentRow={MOCK_USER}
        />
      )

      const submitButton = screen.getByRole('button', { name: /Save Changes/i })
      await userEvent.click(submitButton)

      expect(mockUpdateMutate).toHaveBeenCalledOnce()
      expect(mockUpdateMutate.mock.calls[0][0].userId).toBe(MOCK_USER.UserId)
      expect(mockUpdateMutate.mock.calls[0][0].data).toEqual({
        UserId: MOCK_USER.UserId,
        FullName: MOCK_USER.FullName,
        Email: MOCK_USER.Email,
        PhoneNumber: MOCK_USER.PhoneNumber,
        Role: MOCK_USER.Role,
        EnrollmentNumber: MOCK_USER.EnrollmentNumber,
        ProgramId: undefined,
        SemesterId: undefined,
        CreditBalance: 0,
        CreatedAt: MOCK_USER.CreatedAt,
        password: '',
        confirmPassword: '',
        isEdit: true,
      })
    })
  })
})

async function fillRequiredProfileFields(
  user: UserEvent,
  screen: RenderResult,
  overrides?: User
) {
  const entries = [
    [/Full Name/i, overrides?.FullName ?? 'Alex Smith'],
    [/Email/i, overrides?.Email ?? 'alex@smith.com'],
    [/Phone Number/i, overrides?.PhoneNumber ?? '+19999999999'],
    [/Enrollment No./i, overrides?.EnrollmentNumber ?? 'alex_smith'],
  ] as const

  for (const [label, value] of entries) {
    const el = screen.getByLabelText(label)
    await expect.element(el).toBeInTheDocument()
    await user.fill(el, value)
  }

  const roleSelect = screen.getByRole('combobox', { name: /Role/i })
  await user.click(roleSelect)
  await user.click(
    screen.getByRole('option', { name: overrides?.Role === 'admin' ? 'Admin' : 'Student' })
  )
}

async function fillPasswords(
  user: UserEvent,
  screen: RenderResult,
  a: string,
  b: string
) {
  const password = screen.getByLabelText(/^Password$/i)
  const confirmPassword = screen.getByLabelText(/^Confirm Password$/i)
  await user.fill(password, a)
  await user.fill(confirmPassword, b)
}
