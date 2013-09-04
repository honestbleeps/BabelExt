#pragma once
#include <tchar.H>

void OutputDebugStringFormat( LPCTSTR, ... );

#ifndef NDEBUG
	#define MyDebug OutputDebugStringFormat
#else
	#define MyDebug __noop
#endif

#define RealDebug OutputDebugStringFormat