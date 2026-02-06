# GetHealth200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Status** | Pointer to **string** |  | [optional] 
**Version** | Pointer to **string** |  | [optional] 
**Timestamp** | Pointer to **time.Time** |  | [optional] 
**Uptime** | Pointer to **int32** | Uptime in seconds | [optional] 
**Solana** | Pointer to [**GetHealth200ResponseDataSolana**](GetHealth200ResponseDataSolana.md) |  | [optional] 
**Memory** | Pointer to [**GetHealth200ResponseDataMemory**](GetHealth200ResponseDataMemory.md) |  | [optional] 
**Endpoints** | Pointer to **int32** |  | [optional] 

## Methods

### NewGetHealth200ResponseData

`func NewGetHealth200ResponseData() *GetHealth200ResponseData`

NewGetHealth200ResponseData instantiates a new GetHealth200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGetHealth200ResponseDataWithDefaults

`func NewGetHealth200ResponseDataWithDefaults() *GetHealth200ResponseData`

NewGetHealth200ResponseDataWithDefaults instantiates a new GetHealth200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetStatus

`func (o *GetHealth200ResponseData) GetStatus() string`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *GetHealth200ResponseData) GetStatusOk() (*string, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *GetHealth200ResponseData) SetStatus(v string)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *GetHealth200ResponseData) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### GetVersion

`func (o *GetHealth200ResponseData) GetVersion() string`

GetVersion returns the Version field if non-nil, zero value otherwise.

### GetVersionOk

`func (o *GetHealth200ResponseData) GetVersionOk() (*string, bool)`

GetVersionOk returns a tuple with the Version field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVersion

`func (o *GetHealth200ResponseData) SetVersion(v string)`

SetVersion sets Version field to given value.

### HasVersion

`func (o *GetHealth200ResponseData) HasVersion() bool`

HasVersion returns a boolean if a field has been set.

### GetTimestamp

`func (o *GetHealth200ResponseData) GetTimestamp() time.Time`

GetTimestamp returns the Timestamp field if non-nil, zero value otherwise.

### GetTimestampOk

`func (o *GetHealth200ResponseData) GetTimestampOk() (*time.Time, bool)`

GetTimestampOk returns a tuple with the Timestamp field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTimestamp

`func (o *GetHealth200ResponseData) SetTimestamp(v time.Time)`

SetTimestamp sets Timestamp field to given value.

### HasTimestamp

`func (o *GetHealth200ResponseData) HasTimestamp() bool`

HasTimestamp returns a boolean if a field has been set.

### GetUptime

`func (o *GetHealth200ResponseData) GetUptime() int32`

GetUptime returns the Uptime field if non-nil, zero value otherwise.

### GetUptimeOk

`func (o *GetHealth200ResponseData) GetUptimeOk() (*int32, bool)`

GetUptimeOk returns a tuple with the Uptime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUptime

`func (o *GetHealth200ResponseData) SetUptime(v int32)`

SetUptime sets Uptime field to given value.

### HasUptime

`func (o *GetHealth200ResponseData) HasUptime() bool`

HasUptime returns a boolean if a field has been set.

### GetSolana

`func (o *GetHealth200ResponseData) GetSolana() GetHealth200ResponseDataSolana`

GetSolana returns the Solana field if non-nil, zero value otherwise.

### GetSolanaOk

`func (o *GetHealth200ResponseData) GetSolanaOk() (*GetHealth200ResponseDataSolana, bool)`

GetSolanaOk returns a tuple with the Solana field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSolana

`func (o *GetHealth200ResponseData) SetSolana(v GetHealth200ResponseDataSolana)`

SetSolana sets Solana field to given value.

### HasSolana

`func (o *GetHealth200ResponseData) HasSolana() bool`

HasSolana returns a boolean if a field has been set.

### GetMemory

`func (o *GetHealth200ResponseData) GetMemory() GetHealth200ResponseDataMemory`

GetMemory returns the Memory field if non-nil, zero value otherwise.

### GetMemoryOk

`func (o *GetHealth200ResponseData) GetMemoryOk() (*GetHealth200ResponseDataMemory, bool)`

GetMemoryOk returns a tuple with the Memory field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMemory

`func (o *GetHealth200ResponseData) SetMemory(v GetHealth200ResponseDataMemory)`

SetMemory sets Memory field to given value.

### HasMemory

`func (o *GetHealth200ResponseData) HasMemory() bool`

HasMemory returns a boolean if a field has been set.

### GetEndpoints

`func (o *GetHealth200ResponseData) GetEndpoints() int32`

GetEndpoints returns the Endpoints field if non-nil, zero value otherwise.

### GetEndpointsOk

`func (o *GetHealth200ResponseData) GetEndpointsOk() (*int32, bool)`

GetEndpointsOk returns a tuple with the Endpoints field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEndpoints

`func (o *GetHealth200ResponseData) SetEndpoints(v int32)`

SetEndpoints sets Endpoints field to given value.

### HasEndpoints

`func (o *GetHealth200ResponseData) HasEndpoints() bool`

HasEndpoints returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


