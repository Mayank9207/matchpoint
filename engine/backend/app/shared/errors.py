from __future__ import annotations

from fastapi import HTTPException, status


class CredentialsError(HTTPException):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class EmailAlreadyExistsError(HTTPException):
    def __init__(self, detail: str = "Email already registered") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class NotFoundError(HTTPException):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class SquadFullError(HTTPException):
    def __init__(self, detail: str = "Squad is full") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class NoMatchFoundError(HTTPException):
    def __init__(self, detail: str = "No feasible match found") -> None:
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
