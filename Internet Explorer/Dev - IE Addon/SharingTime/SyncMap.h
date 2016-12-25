#pragma once

#include <windows.h>
#include <map>

template<class K,class T,bool S>
class SyncMap
{
	CRITICAL_SECTION cs;
	
public:

	std::map<K,T> data;
	typedef typename std::map<K,T>::iterator iterator;

	SyncMap()
	{
		if(S) InitializeCriticalSection(&cs);
	}

	~SyncMap()
	{
		if(S) DeleteCriticalSection(&cs);
	}

	T get(K key)
	{
		if(S) EnterCriticalSection(&cs);
		T result=data[key];
		if(S) LeaveCriticalSection(&cs);

		return result;
	}

	T get(K key, const T& defVal)
	{
		if(S) EnterCriticalSection(&cs);
		iterator it = data.find(key);
		T result = (it != data.end()) ? it->second : defVal;
		if(S) LeaveCriticalSection(&cs);

		return result;
	}

	void set(K key, T value)
	{
		if(S) EnterCriticalSection(&cs);
		data[key]=value;
		if(S) LeaveCriticalSection(&cs);
	}

	void erase(K key)
	{
		if(S) EnterCriticalSection(&cs);
		data.erase(key);
		if(S) LeaveCriticalSection(&cs);
	}

	void lock()
	{
		if(S) EnterCriticalSection(&cs);
	}

	void unlock()
	{
		if(S) LeaveCriticalSection(&cs);
	}

	T& operator[](K key)
	{
		lock();
		T& result = data[key];
		unlock();
		return result;
	}
};