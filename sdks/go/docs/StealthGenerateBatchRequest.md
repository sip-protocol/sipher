# StealthGenerateBatchRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Count** | **int32** | Number of keypairs to generate | 
**Label** | Pointer to **string** | Optional label applied to all keypairs | [optional] 

## Methods

### NewStealthGenerateBatchRequest

`func NewStealthGenerateBatchRequest(count int32, ) *StealthGenerateBatchRequest`

NewStealthGenerateBatchRequest instantiates a new StealthGenerateBatchRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStealthGenerateBatchRequestWithDefaults

`func NewStealthGenerateBatchRequestWithDefaults() *StealthGenerateBatchRequest`

NewStealthGenerateBatchRequestWithDefaults instantiates a new StealthGenerateBatchRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetCount

`func (o *StealthGenerateBatchRequest) GetCount() int32`

GetCount returns the Count field if non-nil, zero value otherwise.

### GetCountOk

`func (o *StealthGenerateBatchRequest) GetCountOk() (*int32, bool)`

GetCountOk returns a tuple with the Count field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCount

`func (o *StealthGenerateBatchRequest) SetCount(v int32)`

SetCount sets Count field to given value.


### GetLabel

`func (o *StealthGenerateBatchRequest) GetLabel() string`

GetLabel returns the Label field if non-nil, zero value otherwise.

### GetLabelOk

`func (o *StealthGenerateBatchRequest) GetLabelOk() (*string, bool)`

GetLabelOk returns a tuple with the Label field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLabel

`func (o *StealthGenerateBatchRequest) SetLabel(v string)`

SetLabel sets Label field to given value.

### HasLabel

`func (o *StealthGenerateBatchRequest) HasLabel() bool`

HasLabel returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


