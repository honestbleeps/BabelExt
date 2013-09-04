#include "stdafx.h"
#include "IPCTraceMacros.h"
#include <stdarg.h>
#include <tchar.H>
#include <stdio.h>

#define IPCTRACE(message)                                       \
{                                                               \
    HWND hReceiver = ::FindWindow(NULL, _T("IPCTrace"));          \
    if (hReceiver)                                                \
    {                                                             \
        COPYDATASTRUCT cds;                                         \
        ZeroMemory(&cds, sizeof(COPYDATASTRUCT));                   \
		cds.dwData = 0x00007a69;\
        cds.cbData = strlen(message) + sizeof(CHAR);              \
        cds.lpData = message;                                       \
        ::SendMessage(hReceiver, WM_COPYDATA, NULL, (LPARAM) &cds); \
    }                                                             \
}
//cds.dwData = 0x00031337;                                    \

#define BUFFERSIZE   0x800

void OutputDebugStringFormat( LPCTSTR lpszFormat, ... )
{
	try {
	USES_CONVERSION;
	TCHAR    lpszBuffer[BUFFERSIZE]={0};
	va_list  fmtList;

	va_start( fmtList, lpszFormat );
	_vstprintf( lpszBuffer, lpszFormat, fmtList );
	va_end( fmtList );
	lpszBuffer[BUFFERSIZE-1] = 0;

#ifdef UNICODE
	IPCTRACE(W2A(lpszBuffer));
#else
	IPCTRACE(lpszBuffer);
#endif
	} catch (...) {
		IPCTRACE("[[ERROR WHILE IPCTRACING]]");
	}
}