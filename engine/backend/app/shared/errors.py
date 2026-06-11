"""Custom HTTP exceptions shared across the API."""
from __future__ import annotations

from fastapi import HTTPException, status


class CredentialsError(HTTPException):
    """Raised when authentication fails or a token is invalid/expired."""

    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class EmailAlreadyExistsError(HTTPException):
    """Raised on signup when the email is already registered."""

    def __init__(self, detail: str = "Email already registered") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class NotFoundError(HTTPException):
    """Raised when a requested resource does not exist."""

    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class SquadFullError(HTTPException):
    """Raised when joining a squad that has no remaining capacity."""

    def __init__(self, detail: str = "Squad is full") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class NoMatchFoundError(HTTPException):
    """Raised when the solver cannot assign the squad to any room."""

    def __init__(self, detail: str = "No feasible match found") -> None:
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
